import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req,_,next) => { // _ can be used in place of res if it is not used

    try {

        const token = req.cookies?.accesstoken || req.header("Authorization")?.replace("Bearer ","");

        if(!token){
            throw new ApiError(401, "Unauthorized request");
        }

        const decodedtoken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedtoken._id).select("-password -refreshToken");

        if(!user){
            throw new ApiError(404, "Invalid access token");
        }

        req.user = user;
        next();
        
    } catch (error) {
        throw new ApiError(401, error?.message || "Unauthorized request");
    }
});