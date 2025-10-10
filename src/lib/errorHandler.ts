export type ErrorCategory = 
  | 'authentication'
  | 'authorization' 
  | 'validation'
  | 'not_found'
  | 'server_error';

export function mapError(error: any): { category: ErrorCategory; message: string } {
  const errorMessage = error?.message?.toLowerCase() || '';
  
  // Authentication errors
  if (errorMessage.includes('invalid login') || 
      errorMessage.includes('invalid credentials') ||
      errorMessage.includes('email not confirmed')) {
    return {
      category: 'authentication',
      message: 'Invalid email or password. Please try again.'
    };
  }
  
  // Authorization errors (RLS violations)
  if (errorMessage.includes('row-level security') ||
      errorMessage.includes('permission denied') ||
      errorMessage.includes('insufficient privileges')) {
    return {
      category: 'authorization',
      message: 'You do not have permission to perform this action.'
    };
  }
  
  // Validation errors
  if (errorMessage.includes('violates check constraint') ||
      errorMessage.includes('invalid input') ||
      errorMessage.includes('violates not-null')) {
    return {
      category: 'validation',
      message: 'Invalid input. Please check your data and try again.'
    };
  }
  
  // Not found errors
  if (errorMessage.includes('not found') ||
      errorMessage.includes('no rows')) {
    return {
      category: 'not_found',
      message: 'The requested resource was not found.'
    };
  }
  
  // Default server error
  return {
    category: 'server_error',
    message: 'An unexpected error occurred. Please try again later.'
  };
}

export function logError(context: string, error: any, userId?: string) {
  if (import.meta.env.DEV) {
    const errorDetails = {
      context,
      userId: userId || 'anonymous',
      message: error?.message,
      code: error?.code,
      timestamp: new Date().toISOString(),
    };
    console.error('[ERROR]', JSON.stringify(errorDetails));
  }
}
