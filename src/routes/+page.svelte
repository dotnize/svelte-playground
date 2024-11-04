<script lang="ts">
	import { authClient } from "$lib/auth-client";
	import { Button } from "$lib/components/ui/button";

	const session = authClient.useSession;
</script>

<div class="flex flex-col gap-4 p-6">
	<h1 class="text-4xl font-bold">svelte-starter</h1>
	<div class="flex items-center gap-2">
		This is an unprotected page:
		<div class="rounded-md border bg-card p-1 font-mono text-card-foreground">
			routes/+page.svelte
		</div>
	</div>

	{#if $session.data}
		<div class="flex flex-col gap-2">
			<p>Welcome back, {$session.data.user.name}!</p>
			<Button href="/dashboard" class="w-fit" size="lg">Go to Dashboard</Button>
			<div>
				More data from auth client:
				<pre>{JSON.stringify($session.data.user, null, 2)}</pre>
			</div>
			<Button
				type="button"
				onclick={() => authClient.signOut()}
				class="w-fit"
				variant="destructive"
				size="lg">Sign out</Button
			>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			<p>You are not signed in.</p>
			<Button href="/signin" class="w-fit" size="lg">Sign in</Button>
		</div>
	{/if}

	<a
		class="text-muted-foreground underline hover:text-foreground"
		href="https://github.com/dotnize/svelte-starter"
		target="_blank"
		rel="noreferrer noopener"
	>
		dotnize/svelte-starter
	</a>
</div>
