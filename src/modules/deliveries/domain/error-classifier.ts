import { AttemptResult } from '../../notifications/domain/enums';

export interface ClassifiedError {
  result: AttemptResult;
  errorType: string;
  errorMessage: string;
}

export class ErrorClassifier {
  classify(statusCode: number, errorMessage?: string): ClassifiedError {
    if (statusCode >= 500 || statusCode === 408) {
      return {
        result: AttemptResult.TRANSIENT_ERROR,
        errorType: `HTTP_${statusCode}`,
        errorMessage: errorMessage ?? `Server error: ${statusCode}`,
      };
    }

    if (statusCode >= 400) {
      return {
        result: AttemptResult.PERMANENT_ERROR,
        errorType: `HTTP_${statusCode}`,
        errorMessage: errorMessage ?? `Client error: ${statusCode}`,
      };
    }

    return {
      result: AttemptResult.SUCCESS,
      errorType: 'NONE',
      errorMessage: '',
    };
  }

  classifyTimeout(errorMessage?: string): ClassifiedError {
    return {
      result: AttemptResult.TRANSIENT_ERROR,
      errorType: 'TIMEOUT',
      errorMessage: errorMessage ?? 'Request timed out',
    };
  }

  classifyBounce(errorMessage?: string): ClassifiedError {
    return {
      result: AttemptResult.PERMANENT_ERROR,
      errorType: 'BOUNCE',
      errorMessage: errorMessage ?? 'Email bounced',
    };
  }
}
