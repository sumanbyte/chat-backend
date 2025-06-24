import jwt from "jsonwebtoken";
import { ErrorHandler } from "../utils/utility.js";
import { adminSecretKey } from "../app.js";
import { CHAT_ADMIN_TOKEN, CHAT_TOKEN } from "../constants/config.js";
import { User } from "../models/user.js";

export const isAuthenticated = (req, res, next) => {
  const token = req.cookies[CHAT_TOKEN];
  if (!token) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }
  const decodedData = jwt.verify(token, process.env.JWT_SECRET);

  req.user = decodedData._id;
  next();
};

export const adminOnly = (req, res, next) => {
  const token = req.cookies[CHAT_ADMIN_TOKEN];
  if (!token) {
    return next(new ErrorHandler("ONly admin can access this resource", 401));
  }
  const secretKeyFromToken = jwt.verify(token, process.env.JWT_SECRET);

  const isMatch = adminSecretKey === secretKeyFromToken;

  if (!isMatch) {
    return next(new ErrorHandler("ONly admin can access this resource", 401));
  }

  next();
};

export const socketAuthenticator = async (err, socket, next) => {
  try {
    if (err) return next(err);
    const authToken = socket.request.cookies[CHAT_TOKEN];
    if (!authToken)
      return next(
        new ErrorHandler("Please login to access this resource", 401)
      );
    const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);
    const user = await User.findById(decodedData._id);
    if (!user) return next(new ErrorHandler("Invalid User", 401));
    socket.user = user;

    return next();
  } catch (error) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }
};
