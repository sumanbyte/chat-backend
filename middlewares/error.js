import { envMode } from "../app.js";

export const errorMiddleware = (err, req, res, next) => {
  err.message ||= "Internal Server Error";
  err.statusCode ||= 500;

  // duplicate key error
  if (err.code === 11000) {
    const error = Object.keys(err.keyPattern).join(", ");
    err.message = `Duplicate field - ${error}`;
    err.statusCode = 400;
  }

  if (err.name === "CastError") {
    const errorPath = err.path;
    err.message = `Invalid Format of ${errorPath}`;
    err.statusCode = 400;
  }

  return res.status(err.statusCode).json({
    success: false,
    message: envMode === "development" ? err : err.message,
  });
};

//lets understand this. login needs to be a function so we return a function from the trycatch function. so we are assigning the returned function to login which express calls as login method. why not directly assign the returned function to login ? because there needs to be manual try catch block. by doing so the piece of code for login is abstracted and put inside the try block and error is handled and assigned to the login method reducing the redundancy.

export const TryCatch = (passedFunction) => async (req, res, next) => {
  try {
    await passedFunction(req, res, next);
  } catch (error) {
    next(error);
  }
};
