import { userSocketIDs } from "../app.js";

export const getOtherMember = (members, userId) => {
  return members.find((member) => member._id.toString() !== userId.toString());
};

export const getSockets = (members) =>
  members.map((member) => userSocketIDs.get(member));

export const getBase64 = (file) =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
