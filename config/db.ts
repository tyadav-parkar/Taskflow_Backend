import mongoose from "mongoose";
const connectDB=async():Promise<void>=>{
    await mongoose.connect(`${process.env.MONGODB_URL}/Demo1`)
    .then(()=>{
        console.log("DB Connected")
    }).catch((error)=>{
        console.log(`DB Connection failed : ${error}`)
    })
}
export default connectDB;