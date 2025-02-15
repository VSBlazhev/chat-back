import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    console.log('its runing')
    return 'Hello World!';
  }
}
