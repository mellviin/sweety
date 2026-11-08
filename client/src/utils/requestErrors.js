export function getRequestError(error) {
  if (!error.response) {
    return {
      field: null,
      message: "Cannot reach the server. Please try again.",
    };
  }

  return {
    field: error.response.data?.error?.field ?? null,
    message: error.response.data?.error?.message ?? "Something went wrong. Please try again.",
  };
}
