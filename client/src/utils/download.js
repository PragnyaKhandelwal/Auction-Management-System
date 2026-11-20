// Fetches a file from the API and hands it to the browser as a download
export const downloadFile = async (request, filename) => {
  let res;
  try {
    res = await request({ responseType: "blob" });
  } catch (error) {
    // Errors arrive as a Blob too, so read the server's message out of it
    const body = error.response?.data;
    let message = "Could not download the report.";
    if (body instanceof Blob) {
      try {
        message = JSON.parse(await body.text()).message || message;
      } catch {
        // Not JSON: keep the generic message
      }
    }
    throw new Error(message);
  }

  const url = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
