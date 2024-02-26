import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accesstoken = user.generateAccessToken();
        const refreshtoken = user.generateRefreshToken();
        user.refreshToken = refreshtoken;
        await user.save({validateBeforeSave: false}); //validatebeforesave is set to false because we are not updating any field that requires validation and the user model does not kick in
        return {accesstoken, refreshtoken};
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token");
    }
}

const registerUser = asyncHandler(async (req,res) => {
    //get user details from frontend
    //validatiuon - not empty
    //check if user already exists - uname,email
    //check for images, check for avatar
    //upload them to cloudinary, check if avatar correctly went ot nor
    //create user object - entry to db
    //remove password and refreshtoken field from response
    //check for user creation
    //return yes

    const {fullName,email,username,password} = req.body;
    // console.log("email: ",email);

    //checking if any of the fields are empty (validation)
    if([fullName,email,username,password].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new ApiError(209, "User with email or username already existed");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const CoverImageLocalPath = req.files?.coverImage[0]?.path;
    let CoverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        CoverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(CoverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Failed to upload avatar image");
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering user");
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )
    //res.status(200).json({message:"Received"});
})

const loginUser = asyncHandler(async (req,res) => {
    //req body -> data
    //username or email
    //find the user
    //check password
    //accesstoken and refreshtoken
    //send cookie

    const{username, email, password} = req.body;

    if(!(username || email)){
        throw new ApiError(400, "Username or email is required");
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid password");
    }

    const {accesstoken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const option = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("refreshtoken", refreshToken, option)
    .cookie("accesstoken", accesstoken, option)
    .json(
        new ApiResponse(
            200,
            {user: loggedInUser,refreshToken,accesstoken},
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req,res) => {

    await User.findByIdAndUpdate(req.user._id, {refreshToken: undefined}, {new: true});

    const option = {
        httpOnly: true,
        secure: true,
    }

    res.status(200).clearCookie("accesstoken", option).clearCookie("refreshtoken", option).json( new ApiResponse(200,{},"User logged out"));
})

const RefreshAccessToken = asyncHandler(async (req,res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken._id);

        if(!user){
            throw new ApiError(404, "Invalid Refresh Token");
        }

        if(user.refreshToken !== incomingRefreshToken){
            throw new ApiError(401, "Refresh token has expired or used");
        }

        const {accesstoken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);

        const option = {
            httpOnly: true,
            secure: true
        }

        res.status(200)
        .cookie("accetoken", accesstoken, option)
        .cookie("refreshtoken", newRefreshToken, option)
        .json(new ApiResponse(200, {accesstoken, refreshToken:newRefreshToken}, "Access token refreshed successfully"))

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
})

const changePassword = asyncHandler(async (req,res) => {
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(404, "Invalid old password");
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200).json(new ApiResponse(200,{},"Password changed successfully"));
})

const getCurrentUser = asyncHandler(async (req,res) => {
    // const user = await User.findById(req.user?._id).select("-password -refreshToken");
    // if(!user){
    //     throw new ApiError(404, "User not found");
    // }
    return res.status(200).json(new ApiResponse(200,req.user,"Current user fetched successfully"));
})

const updateAccountDetails = asyncHandler(async (req,res) => {
    const {fullName, email} = req.body;
    if(!fullName || !email){
        throw new ApiError(400, "Full name and email are required");
    }
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {$set:{fullName, email}},
        {new: true}
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200,user,"User details updated successfully"));
})

const updateUserAvatar = asyncHandler(async (req,res) => {

    const avatarLocalPath = req.files?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(500, "Error while uploading on Cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {$set:{avatar: avatar.url}},
        {new: true}
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200,user,"User avatar updated successfully"));
})

const updateUserCoverImage = asyncHandler(async (req,res) => {

    const coverImageLocalPath = req.files?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400, "CoverImage image is required");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(500, "Error while uploading on Cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {$set:{coverImage: coverImage.url}},
        {new: true}
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200,user,"User CoverImage updated successfully"));
})

const getUserChannelProfile = asyncHandler(async (req,res) => {
    const {username} = req.params;

    if(!username.trim()){
        throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {$size: "$subscribers"},
                channelsSubscribedToCount: {$size: "$subscribedTo"},
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                email: 1,            
            }
        }
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist");
    }

    return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"));
})

export {registerUser, loginUser, logoutUser, RefreshAccessToken, changePassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile}