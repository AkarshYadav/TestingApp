import connect from "@/lib/mongodb/mongoose";
import AttendanceKey from "@/lib/models/AttendanceKey.model";

export const POST = async (req) => {
    try {
        const body = await req.json(); // Parse the request body
        const { classId, newKey } = body;
        console.log("classId: ", classId);
        console.log("newKey: ", newKey);

        if (!classId || !newKey) {
            return new Response(JSON.stringify({ message: "Missing classId or newKey." }), {
                status: 400,
            });
        }

        const db = await connect();

        // Delete previous keys for the class
        await AttendanceKey.deleteMany({ classId });

        // Insert the new key
        const newAttendanceKey = new AttendanceKey({
            classId,
            key: newKey,
            createdAt: new Date(), // Track when the key was created
        });

        await newAttendanceKey.save();

        return new Response(JSON.stringify({ message: "Key updated successfully." }), {
            status: 200,
        });
    } catch (error) {
        console.error("Error updating key:", error);
        return new Response(JSON.stringify({ message: "Failed to update key." }), {
            status: 500,
        });
    }
};
