import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Login-page demo accounts from the users collection (no passwords)' })
  @ApiQuery({ name: 'role', required: false })
  listAccounts(@Query('role') role?: string) {
    return this.authService.listLoginAccounts(role);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check email + password against the users collection' })
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body?.email, body?.password);
  }
}
