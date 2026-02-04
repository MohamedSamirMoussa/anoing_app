import axios from "axios";
import { OAuth2Client, TokenPayload } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID as string);

export const verifyGoogleToken = async (token: string) => {
  if (token.startsWith("ya29.")) {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/oauth2/v3/userinfo`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const data = response.data;
      return {
        email: data.email,
        name: data.name,
        picture: data.picture,
        sub: data.sub, 
        email_verified: data.email_verified,
      };
    } catch (error) {
      throw new Error("Invalid Google Access Token");
    }
  }

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_ID_CLIENT as string,
  });

  const payload = ticket.getPayload();

  return payload as TokenPayload;
};
