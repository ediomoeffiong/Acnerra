import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.DATABASE_URL;

  if (!uri) {
    console.error("DATABASE_URL is not defined in environment variables.");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
