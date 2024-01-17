// using promises
const asyncHandler = (requestHandler) => {
    (req,res,next) => {
        Promise.resolve(requestHandler(req,res,next))
        .catch((error)=>{next(error)})
    }
}

// using try catch block
// const asyncHandler = (fn) => async (req,res,next) => {
//     try {
//         await fn(req,res,next);
//     } catch (error) {
//         res.status(error.status||500).json({
//             successs:false,message:error.message
//         })
//     }
// }

export {asyncHandler} //similar way of export default asyncHandler