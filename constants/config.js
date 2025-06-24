export const corsOptions = {
  origin: ["http://localhost:5173", process.env.CLIENT_URL],
  credentials: true,
};

export const CHAT_TOKEN = "chat-token";
export const CHAT_ADMIN_TOKEN = "chat-admin-token";
