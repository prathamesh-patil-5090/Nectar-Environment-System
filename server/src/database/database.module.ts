import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('database.uri')?.trim();
        if (!uri) {
          throw new Error(
            'MONGODB_URI is missing. Set it in server/.env (see server/.env.example).',
          );
        }
        const masked = uri.replace(/:([^:@]+)@/, ':****@');
        console.log(`📦 MongoDB URI loaded from env: ${masked}`);
        return {
          uri,
          dbName: config.get<string>('database.name') ?? 'nectar_enviro',
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
