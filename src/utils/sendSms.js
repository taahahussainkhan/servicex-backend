import twilio from "twilio";

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

const sendOtpSms = async (to, otp) => {
  try {
    const msg = await client.messages.create({
      body: `🔐 Your verification code is: ${otp}`,
      from: fromNumber,
      to: to, 
    });
    return msg;
  } catch (err) {
    console.error("❌ Failed to send SMS:", err);
    throw err;
  }
};

export default sendOtpSms;
