import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.DATABASE_URL;

  if (!uri) {
    console.error("WARNING: MONGO_URI or DATABASE_URL is not defined in environment variables. Database features will fail.");
    return;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    console.error("The server will continue running, but database operations will fail until connection is established.");
  }
};

