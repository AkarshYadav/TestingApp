import connect from "@/lib/mongodb/mongoose";
import AttendanceKey from "@/lib/models/AttendanceKey.model";

export const GET = async (req) => {
    try {
        // Extract classId from the query parameters (from the URL)
        const url = new URL(req.url);
        const classId = url.searchParams.get('classId');

        if (!classId) {
            return new Response(
                JSON.stringify({ message: "Missing classId in query." }),
                { status: 400 }
            );
        }

        // Connect to the database
        await connect();
        console.log("Querying Database for Class ID:", classId);

        // Fetch the latest attendance key for the class (sorted by `createdAt`)
        const latestKey = await AttendanceKey.findOne({ classId }).sort({ createdAt: -1 }).exec();

        if (!latestKey) {
            console.log("No key found for this class.");
            return new Response(
                JSON.stringify({ message: "No key found for this class." }),
                { status: 404 }
            );
        }

        console.log("Latest Key Retrieved:", latestKey.key);
        return new Response(
            JSON.stringify({ latestKey: latestKey.key }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching latest key:", error);
        return new Response(
            JSON.stringify({ message: "Failed to retrieve the key." }),
            { status: 500 }
        );
    }
};
