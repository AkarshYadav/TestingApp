import mongoose from 'mongoose';

const attendanceKeySchema = new mongoose.Schema({
    classId: {
        type: String,
        required: true,
    },
    key: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '30s' },
    },
});

// Create the model
const AttendanceKey = mongoose.models.AttendanceKey || mongoose.model('AttendanceKey', attendanceKeySchema);

export default AttendanceKey;
