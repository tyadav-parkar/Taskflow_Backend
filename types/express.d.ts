import "express";
declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string }; // set by auth middleware
  }
}
