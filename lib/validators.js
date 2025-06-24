import { body, validationResult, check, param, query } from "express-validator";
import { ErrorHandler } from "../utils/utility.js";

export const registerValidator = () => [
  body("name", "Please enter name").notEmpty(),
  body("username", "Please enter username").notEmpty(),
  body("bio", "Please enter Bio").notEmpty(),
  body("password", "Please enter Password").notEmpty(),
];

export const loginValidator = () => [
  body("username", "Please enter username").notEmpty(),
  body("password", "Please enter Password").notEmpty(),
];
export const newGroupValidator = () => [
  body("name", "Please enter name").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please enter members")
    .isArray({ min: 2, max: 100 })
    .withMessage("Members must be 2-100"),
];
export const addMemberValidator = () => [
  body("chatId", "Please enter Chat ID").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please enter members")
    .isArray({ min: 1, max: 97 })
    .withMessage("Members must be 1-97"),
];
export const removeMembersValidator = () => [
  body("chatId", "Please enter Chat ID").notEmpty(),
  body("members").notEmpty().withMessage("Please enter members"),
];

export const leaveGroupValidator = () => [
  param("chatId", "Please enter chat id").notEmpty(),
];

export const sendAttachmentsValidator = () => [
  body("chatId", "Please enter chat id").notEmpty(),
];

export const chatIdValidator = () => [
  param("id", "Please enter chat id").notEmpty(),
];

export const renameGroupValidator = () => [
  param("id", "Please enter chat id").notEmpty(),
  body("name", "Please enter new name").notEmpty(),
];
export const sendFriendRequestValidator = () => [
  body("userId", "Please enter user Id").notEmpty(),
];
export const acceptFriendRequestValidator = () => [
  body("requestId", "Please enter request Id").notEmpty(),
  body("accept", "Please add accept")
    .notEmpty()
    .isBoolean()
    .withMessage("Accept must be boolean"),
];

export const adminLoginValidator = () => [
  body("secretKey", "Please enter secret key").notEmpty(),
];

export const validate = (req, res, next) => {
  const errors = validationResult(req);

  const errorMessages = errors
    .array()
    .map(({ msg }) => msg)
    .join(", ");

  if (errors.isEmpty()) return next();
  next(new ErrorHandler(errorMessages, 400));
};
