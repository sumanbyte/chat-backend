import {
  ALERT,
  NEW_ATTACHMENT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../shared/events.js";
import { getOtherMember } from "../lib/helper.js";
import { TryCatch } from "../middlewares/error.js";
import { Chat } from "../models/chat.js";
import {
  deleteFromCloudinary,
  emitEvent,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";
import { User } from "../models/user.js";
import { Message } from "../models/message.js";
import { userSocketIDs } from "../app.js";

export const newGroupChat = TryCatch(async (req, res, next) => {
  const { name, members } = req.body;

  if (members.length < 2)
    return next(
      new ErrorHandler(
        "Atleast 2 members are required to create a group chat",
        400
      )
    );
  const allMembers = [...members, req.user];
  const chat = await Chat.create({
    name,
    members: allMembers,
    groupChat: true,
    creator: req.user,
  });
  emitEvent(req, ALERT, allMembers, {
    message: `Welcome to ${name} group chat!`,
    chatId: chat._id,
  });
  emitEvent(req, REFETCH_CHATS, members, "Chats updated successfully");

  return res.status(201).json({
    success: true,
    message: "Group chat created successfully",
  });
});

export const getMyChats = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({ members: req.user }).populate(
    "members",
    "name avatar"
  );

  const transformedChats = chats.map(({ _id, name, groupChat, members }) => {
    const otherMember = getOtherMember(members, req.user);
    return {
      _id,
      groupChat,
      avatar: groupChat
        ? members.slice(0, 3).map(({ avatar }) => {
            return avatar.url;
          })
        : [otherMember.avatar.url],
      name: groupChat ? name : otherMember.name,
      members: members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.user.toString()) {
          prev.push(curr._id);
        }
        return prev;
      }, []),
    };
  });

  return res.status(200).json({
    success: true,
    chats: transformedChats,
    message: "Group chat fetched successfully",
  });
});

export const getMyGroups = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({
    members: req.user,
    groupChat: true,
  }).populate("members", "name avatar");

  const groups = chats.map(({ members, _id, groupChat, name }) => {
    return {
      _id,
      name,
      groupChat,
      avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
    };
  });

  return res.status(200).json({
    message: "Groups fetched successfully",
    success: true,
    groups,
  });
});

export const addMembers = TryCatch(async (req, res, next) => {
  const { chatId, members } = req.body;

  if (!members || members.length < 1)
    return next(new ErrorHandler("Atleast 1 member is required to add", 400));

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));
  if (!chat.groupChat) return next(new ErrorHandler("Not a group chat", 400));

  if (chat.creator.toString() !== req.user.toString()) {
    return next(new ErrorHandler("Only creator can add members", 403));
  }

  const allNewMembersPromise = members.map((i) => User.findById(i, "name"));

  const allNewMembers = await Promise.all(allNewMembersPromise);

  const uniqueMembers = allNewMembers
    .filter((i) => !chat.members.includes(i._id.toString()))
    .map((i) => i._id);

  chat.members.push(...uniqueMembers);

  if (chat.members.length > 100) {
    return next(
      new ErrorHandler("Group chat cannot have more than 100 members", 400)
    );
  }

  await chat.save();

  const allUsersName = allNewMembers.map((i) => i.name).join(", ");

  const chatMembers = chat.members.map((member) => member._id.toString());
  emitEvent(req, ALERT, chatMembers, {
    message: `${allUsersName} has been added in the group`,
    chatId: chatId,
  });
  const membersArray = chat.members.map((member) => member._id.toString());
  emitEvent(req, REFETCH_CHATS, membersArray);

  return res.status(200).json({
    message: "Members added successfully",
    success: true,
  });
});

export const removeMembers = TryCatch(async (req, res, next) => {
  const { chatId, members } = req.body;

  if (!members || members.length < 1)
    return next(new ErrorHandler("No Members to remove", 400));

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat not found", 404));
  if (!chat.groupChat) return next(new ErrorHandler("Not a group chat", 400));

  if (members.includes(chat.creator.toString())) {
    return next(new ErrorHandler("Cannot remove creator from group", 400));
  }

  const filteredMembers = chat.members.filter(
    (i) => !members.includes(i.toString())
  );

  const allMembers = chat.members;

  chat.members = filteredMembers;
  //   console.log(filteredMembers);
  if (chat.members.length < 3) {
    return next(
      new ErrorHandler("Group chat must have atleast 3 members", 400)
    );
  }

  const [allUsersName, _] = await Promise.all([
    (await Promise.all(members.map((member) => User.findById(member, "name"))))
      .map((i) => i.name)
      .join(", "),
    chat.save(),
  ]);

  const chatMembers = filteredMembers.map((member) => member._id.toString());

  emitEvent(req, ALERT, chatMembers, {
    message: `${allUsersName} has been removed from the group`,
    chatId,
  });

  const membersArray = allMembers.map((member) => member._id.toString());
  emitEvent(req, REFETCH_CHATS, membersArray);

  return res.status(200).json({
    message: "Members removed successfully",
    success: true,
  });
});

export const leaveGroup = TryCatch(async (req, res, next) => {
  const { chatId } = req.params;
  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat) return next(new ErrorHandler("Not a group chat", 400));

  const filteredMembers = chat.members.filter(
    (i) => i.toString() !== req.user.toString()
  );

  if (req.user.toString() === chat.creator.toString()) {
    const randomNumber = Math.floor(Math.random() * filteredMembers.length);
    chat.creator = filteredMembers[randomNumber];
  }

  chat.members = filteredMembers;

  if (chat?.members?.length < 1) {
    await chat.deleteOne();
  }

  const [user] = await Promise.all([
    User.findById(req.user, "name"),
    chat.save(),
  ]);

  emitEvent(req, REFETCH_CHATS, filteredMembers);
  emitEvent(req, ALERT, filteredMembers, {
    chatId,
    message: `${user.name} has left the group.`,
  });
  return res.status(200).json({
    message: "Group chat left successfully",
    success: true,
  });
});

export const sendAttachments = TryCatch(async (req, res, next) => {
  const { chatId } = req.body;

  const files = req.files || [];

  if (files.length < 1)
    return next(new ErrorHandler("Please upload Attachments", 400));

  if (files.length > 5) {
    return next(new ErrorHandler("Files can't be more than 5", 400));
  }

  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "name"),
  ]);
  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  //upload files here
  const attachments = await uploadFilesToCloudinary(files);
  const messageForDB = {
    content: "",
    attachments,
    sender: me._id,
    chat: chatId,
  };
  const messageForRealTime = {
    ...messageForDB,
    sender: {
      _id: me._id,
      name: me.name,
    },
  };

  const message = await Message.create(messageForDB);

  const chatMembers = chat.members.map((member) => member._id.toString());

  emitEvent(req, NEW_MESSAGE, chatMembers, {
    message: messageForRealTime,
    chatId,
  });

  emitEvent(req, NEW_MESSAGE_ALERT, chatMembers, {
    chatId,
  });

  return res.status(200).json({
    success: true,
    message,
  });
});

export const getChatDetails = TryCatch(async (req, res, next) => {
  if (req.query.populate == "true") {
    const chat = await Chat.findById(req.params.id)
      .populate("members", "name avatar")
      .lean();

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    chat.members = chat.members.map(({ _id, name, avatar }) => ({
      _id,
      name,
      avatar: avatar.url,
    }));

    return res.status(200).json({
      success: true,
      chat,
      message: "Chat details fetched successfully",
    });
  } else {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return next(new ErrorHandler("Chat not found", 404));
    return res.status(200).json({
      success: true,
      chat,
      message: "Chat details fetched successfully",
    });
  }
});

//rename group chat
export const renameGroupChat = TryCatch(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);
  const { name } = req.body;

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat) return next(new ErrorHandler("Not a group chat", 400));

  if (chat.creator.toString() !== req.user.toString()) {
    return next(new ErrorHandler("Only creator can rename group chat", 403));
  }

  chat.name = name;

  await chat.save();
  const memberArray = chat.members.map((member) => member._id.toString());
  emitEvent(req, REFETCH_CHATS, memberArray);

  return res.status(200).json({
    success: true,
    message: "Group chat renamed successfully",
    chat,
  });
});

export const deleteChat = TryCatch(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  const members = chat.members;
  if (chat.groupChat && chat.creator.toString() !== req.user.toString()) {
    return next(new ErrorHandler("Only creator can delete group chat", 403));
  }

  const attachments = await Message.find({
    chat: req.params.id,
    attachments: { $exists: true, $ne: [] },
  });

  const public_ids = [];
  attachments.forEach(({ public_id }) => {
    public_ids.push(public_id);
  });

  await Promise.all([
    //delete files from cloudinary
    deleteFromCloudinary(public_ids),
    chat.deleteOne(),
    Message.deleteMany({ chat: req.params.id }),
  ]);

  const chatMembers = members.map((member) => member._id.toString());

  emitEvent(req, REFETCH_CHATS, chatMembers);

  return res.status(200).json({
    success: true,
    message: "Group chat deleted successfully",
  });
});

export const getMessages = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.members.includes(req.user.toString()))
    return next(new ErrorHandler("Not a member", 400));

  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  const [messages, totalMessagesCount] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .populate("sender", "name"),
    Message.countDocuments({ chat: chatId }),
  ]);
  const reversedMessages = messages.reverse(); // Oldest first on screen

  const messageDates = reversedMessages.map(({ createdAt }) =>
    new Date(createdAt).toLocaleString()
  );

  const totalPages = Math.ceil(totalMessagesCount / limit);

  return res.status(200).json({
    success: true,
    messages: reversedMessages,
    message: "Messages fetched successfully",
    totalPages,
  });
});
