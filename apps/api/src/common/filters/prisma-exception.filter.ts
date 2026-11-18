import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

type PrismaError = Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError;

/** HTTP status and message for a Prisma error; null for ones that are a real server fault */
export function prismaErrorResponse(e: PrismaError): { status: number; message: string } | null {
  // Input Prisma refuses before it reaches the database: an unknown enum value, a wrong type
  if (e instanceof Prisma.PrismaClientValidationError) return { status: HttpStatus.BAD_REQUEST, message: 'Invalid value' };
  switch (e.code) {
    case 'P2002':
      return { status: HttpStatus.CONFLICT, message: 'Already exists' };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Not found' };
    case 'P2003':
      return { status: HttpStatus.BAD_REQUEST, message: 'Refers to something that does not exist' };
    case 'P2000':
    case 'P2006':
    case 'P2007':
    case 'P2009':
    case 'P2023':
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid value' };
    default:
      return null;
  }
}

/** Prisma errors as HTTP answers instead of a blanket 500; database detail stays in the log */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Prisma');

  catch(e: PrismaError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const known = prismaErrorResponse(e);
    if (!known) this.log.error(e.message, e.stack);
    const { status, message } = known ?? { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    res.status(status).json({ statusCode: status, message });
  }
}
