import axios from "axios";

export const getAccessToken = async (): Promise<string> => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET_ID;

  try {
    const response = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials", // باي بال بيفضل الداتا هنا كـ URL search params
      {
        auth: {
          username: clientId!,
          password: clientSecret!,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.access_token;
  } catch (error: any) {
    console.error("PayPal Auth Failed:", error.response?.data || error.message);
    throw error;
  }
};