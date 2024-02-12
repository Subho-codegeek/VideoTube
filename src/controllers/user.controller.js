import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export {registerUser}