<script lang="ts">
	import { Button } from "$lib/components/ui/button";
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="flex flex-col items-center gap-8 rounded-xl border bg-card p-10">
		Logo here
		<form method="GET" class="flex flex-col gap-2">
			<Button formaction="/api/auth/discord" type="submit" variant="outline" size="lg">
				Sign in with Discord
			</Button>
			<Button formaction="/api/auth/github" type="submit" variant="outline" size="lg">
				Sign in with GitHub
			</Button>
			<Button formaction="/api/auth/google" type="submit" variant="outline" size="lg">
				Sign in with Google
			</Button>
		</form>
	</div>
</div>
