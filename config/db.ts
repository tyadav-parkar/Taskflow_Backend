import mongoose from "mongoose";
const connectDB=async():Promise<void>=>{
    await mongoose.connect(`${process.env.MONGODB_URL}/taskflow`)
    .then(()=>{
        console.log("DB Connected")
    }).catch((error)=>{
        console.log(`DB Connection failed : ${error}`)
    })
}
export default connectDB;