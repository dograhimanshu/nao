import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import type { UIMessage } from '@nao/backend/chat';
import type { FormEvent, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/main';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { getMessageText } from '@/lib/ai';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function AssistantMessageActions({
	message,
	className,
	chatId,
}: {
	message: UIMessage;
	className?: string;
	chatId: string;
}) {
	const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
	const [pendingVote, setPendingVote] = useState<'up' | 'down'>('down');
	const { isCopied, copy } = useCopyToClipboard();

	const submitFeedback = useMutation(
		trpc.feedback.submit.mutationOptions({
			onSuccess: (data, _, __, ctx) => {
				ctx.client.setQueryData(trpc.chat.get.queryKey({ chatId }), (prev) =>
					prev
						? {
								...prev,
								messages: prev.messages.map((m) =>
									m.id === message.id ? { ...m, feedback: data } : m,
								),
							}
						: prev,
				);
			},
		}),
	);

	const openFeedbackDialog = (vote: 'up' | 'down') => {
		setPendingVote(vote);
		setShowFeedbackDialog(true);
	};

	const handleFeedbackSubmit = (explanation?: string) => {
		submitFeedback.mutate({
			chatId,
			messageId: message.id,
			vote: pendingVote,
			explanation,
		});
		setShowFeedbackDialog(false);
	};

	return (
		<>
			<div className={cn('flex items-center gap-1', className)}>
				<Button
					variant='ghost'
					size='icon-sm'
					onClick={() => openFeedbackDialog('up')}
					disabled={submitFeedback.isPending}
					className={cn(
						'hover:rounded-full',
						message.feedback?.vote === 'up' ? 'text-primary' : 'opacity-50 hover:opacity-100',
					)}
					aria-label='Good response'
				>
					<ThumbsUp className='size-4' />
				</Button>

				<Button
					variant='ghost'
					size='icon-sm'
					onClick={() => openFeedbackDialog('down')}
					disabled={submitFeedback.isPending}
					className={cn(
						'hover:rounded-full',
						message.feedback?.vote === 'down' ? 'text-primary' : 'opacity-50 hover:opacity-100',
					)}
					aria-label='Bad response'
				>
					<ThumbsDown className='size-4' />
				</Button>

				<Button
					variant='ghost'
					size='icon-sm'
					onClick={() => copy(getMessageText(message))}
					className='opacity-50 hover:opacity-100 hover:rounded-full'
					aria-label='Copy message'
				>
					{isCopied ? <Check className='size-4' /> : <Copy className='size-4' />}
				</Button>
			</div>

			<FeedbackDialog
				open={showFeedbackDialog}
				onOpenChange={setShowFeedbackDialog}
				onSubmit={handleFeedbackSubmit}
				isPending={submitFeedback.isPending}
				vote={pendingVote}
			/>
		</>
	);
}

const FEEDBACK_DIALOG_COPY = {
	up: {
		title: 'What went well?',
		description: 'Help us improve by explaining what went well with this response.',
		placeholder: 'Tell us what you liked (optional)',
	},
	down: {
		title: 'What went wrong?',
		description: 'Help us improve by explaining what was wrong with this response.',
		placeholder: 'Tell us what could be better (optional)',
	},
} as const;

interface FeedbackDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (explanation?: string) => void;
	isPending: boolean;
	vote?: 'up' | 'down';
}

export function FeedbackDialog({ open, onOpenChange, onSubmit, isPending, vote = 'down' }: FeedbackDialogProps) {
	const [explanation, setExplanation] = useState('');
	const copy = FEEDBACK_DIALOG_COPY[vote];

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		onSubmit(explanation.trim() || undefined);
		setExplanation('');
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			e.currentTarget.form?.requestSubmit();
		}
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setExplanation('');
		}
		onOpenChange(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent showCloseButton>
				<DialogHeader>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription className='text-sm text-muted-foreground font-medium'>
						{copy.description}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<Textarea
						placeholder={copy.placeholder}
						value={explanation}
						onKeyDown={handleKeyDown}
						onChange={(e) => setExplanation(e.target.value)}
						rows={4}
						className='resize-none bg-panel break-words [overflow-wrap:anywhere]'
					/>

					<Button variant='primary-gradient' className='rounded-full' type='submit' disabled={isPending}>
						Submit
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
