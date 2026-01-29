export const getDiscordUrl = () => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    response_type: "code",
    scope: "identify",
  });


  return `${process.env.DISCORD_AUTH_URL}?${params.toString()}`;
};
