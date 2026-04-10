export const getErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "An unexpected error occurred. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("401") || message.includes("unauthorized")) {
    return "Authentication error: Please check your API key in the .env file.";
  }
  if (message.includes("429") || message.includes("rate limit")) {
    return "Rate limit exceeded. Please try again in a few moments.";
  }
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("econnrefused")
  ) {
    return "Network error: Please check your internet connection.";
  }
  if (message.includes("timeout")) {
    return "Request timeout: The service took too long to respond. Please try again.";
  }
  return "Sorry, I encountered an error while processing your request. Please try again.";
};
