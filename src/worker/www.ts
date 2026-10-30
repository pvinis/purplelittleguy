// www.purplelittleguy.com sends everyone to the bare domain, keeping the path.
export default {
	fetch(request: Request): Response {
		const url = new URL(request.url);
		url.protocol = "https:";
		url.hostname = "purplelittleguy.com";
		url.port = "";
		return Response.redirect(url.toString(), 301);
	},
};
