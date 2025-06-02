const errorHandling = (err, req, res, next) => {
    console.error(err); // This will now print full error object to console
  
    res.status(500).json({
      success: false,
      message: err.message || "Server Error",
      stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
  };
  
  export default errorHandling;
  