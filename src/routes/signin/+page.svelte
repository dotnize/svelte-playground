<script lang="ts">
	import { authClient } from "$lib/auth-client";
	import { Button } from "$lib/components/ui/button";

	// redirect after login
	const CALLBACK_URL = "/dashboard";
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="flex flex-col items-center gap-8 rounded-xl border bg-card p-10">
		Logo here
		<div class="flex flex-col gap-2">
			<Button
				type="button"
				onclick={() => authClient.signIn.social({ provider: "discord", callbackURL: CALLBACK_URL })}
				variant="outline"
				size="lg"
			>
				Sign in with Discord
			</Button>
			<Button
				type="button"
				onclick={() => authClient.signIn.social({ provider: "github", callbackURL: CALLBACK_URL })}
				variant="outline"
				size="lg"
			>
				Sign in with GitHub
			</Button>
			<Button
				type="button"
				onclick={() => authClient.signIn.social({ provider: "google", callbackURL: CALLBACK_URL })}
				variant="outline"
				size="lg"
			>
				Sign in with Google
			</Button>
		</div>
	</div>
</div>
;
