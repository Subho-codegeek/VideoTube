import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) //it might override with same name but the files will be in temp storage for very small amount of time so chances of override is vert low.
    }
  })
  
export const upload = multer({ 
    storage, 
})