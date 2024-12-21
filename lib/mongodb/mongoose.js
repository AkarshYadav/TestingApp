import mongoose from "mongoose";

let isConnected = false;

const connect = async () => {
    if (isConnected) {
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        console.log("Connected to MongoDB");
    } catch (error) {
        console.log("Something went wrong while connecting to MongoDB", error);
        throw error; // Propagate the error to handle it in the routes
    }
}

// Add event listeners for connection status
mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    isConnected = false;
    console.log('MongoDB connection error:', err);
});

export default connect;