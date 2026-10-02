export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:3000',
  database: {
    uri: process.env.MONGODB_URI ?? '',
    name: process.env.MONGODB_DB_NAME ?? 'nectar_enviro',
  },
});
