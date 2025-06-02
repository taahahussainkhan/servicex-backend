import nodemailer from "nodemailer";


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", 
  port: 465, 
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

const sendOtpEmail = async (toEmail, otp) => {
  const mailOptions = {
    from: `"ServiceX - your platform for homebased services." <${process.env.EMAIL_USER}>`, 
    to: toEmail,
    subject: "Your OTP Code - Please Verify",
    html: `<h3>Your OTP code is <b>${otp}</b></h3>
           <p>This OTP will expire in 10 minutes.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${toEmail}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send OTP email");
  }
};

export default sendOtpEmail;
