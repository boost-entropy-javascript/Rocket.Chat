import type { IMessage, MessageQuoteAttachment } from '@rocket.chat/core-typings';
import { Modal, Field, FieldGroup, ButtonGroup, Button } from '@rocket.chat/fuselage';
import { useMutableCallback, useClipboard } from '@rocket.chat/fuselage-hooks';
import { useTranslation, useEndpoint, useToastMessageDispatch, useUserAvatarPath } from '@rocket.chat/ui-contexts';
import { useMutation } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import React, { memo } from 'react';
import { useForm, Controller } from 'react-hook-form';

import UserAndRoomAutoCompleteMultiple from '../../../../components/UserAndRoomAutoCompleteMultiple.tsx';
import { QuoteAttachment } from '../../../../components/message/content/attachments/QuoteAttachment';
import { prependReplies } from '../../../../lib/utils/prependReplies';

type ShareMessageProps = {
	onClose: () => void;
	permalink: string;
	message: IMessage;
};

type roomType = {
	label: string;
	value: string;
	_id: string;
	type: string;
};

const ShareMessageModal = ({ onClose, permalink, message }: ShareMessageProps): ReactElement => {
	const t = useTranslation();
	const getUserAvatarPath = useUserAvatarPath();
	const dispatchToastMessage = useToastMessageDispatch();
	const { copy, hasCopied } = useClipboard(permalink);

	const { control, watch } = useForm({
		defaultValues: {
			rooms: [],
		},
	});

	const rooms = watch('rooms');
	const sendMessage = useEndpoint('POST', '/v1/chat.postMessage');

	const onChangeUserOrRoom = useMutableCallback((handleRoomsAndUsers: (rooms: roomType[]) => void, room: roomType, action?: string) => {
		if (!action) {
			if (rooms.find((cur: roomType) => cur._id === room._id)) return;
			return handleRoomsAndUsers([...rooms, room]);
		}
		handleRoomsAndUsers(rooms.filter((cur: roomType) => cur._id !== room._id));
	});

	const sendMessageMutation = useMutation({
		mutationFn: async () => {
			const optionalMessage = '';
			const curMsg = await prependReplies(optionalMessage, [message]);

			return Promise.all(
				rooms.map(async (room: roomType) => {
					const sendPayload = {
						roomId: room._id,
						text: curMsg,
					};

					await sendMessage(sendPayload);
				}),
			);
		},
		onSuccess: () => {
			dispatchToastMessage({ type: 'success', message: t('Message_has_been_shared') });
		},
		onError: (error: any) => {
			dispatchToastMessage({ type: 'error', message: error });
		},
		onSettled: () => {
			onClose();
		},
	});

	const avatarUrl = getUserAvatarPath(message.u.username);

	const attachment = {
		author_name: message.u?.username,
		author_link: '',
		author_icon: avatarUrl,
		message_link: '',
		text: message.msg,
		attachments: message.attachments as MessageQuoteAttachment[],
		md: message.md,
	};

	const handleCopy = (): void => {
		if (!hasCopied) {
			copy();
		}
	};

	return (
		<Modal>
			<Modal.Header>
				<Modal.Title>{t('Share_Message')}</Modal.Title>
				<Modal.Close onClick={onClose} title={t('Close')} />
			</Modal.Header>
			<Modal.Content>
				<FieldGroup>
					<Field>
						<Field.Label>{t('Person_Or_Channel')}</Field.Label>
						<Field.Row>
							<Controller
								name='rooms'
								control={control}
								render={({ field }): ReactElement => (
									<UserAndRoomAutoCompleteMultiple
										value={field.value.map((room: roomType) => room.value)}
										onChange={(room, action): void => onChangeUserOrRoom(field.onChange, room, action)}
									/>
								)}
							/>
						</Field.Row>
						{!rooms.length && <Field.Hint>{t('Select_atleast_one_channel_to_share_the_messsage')}</Field.Hint>}
					</Field>
					<Field>
						<QuoteAttachment attachment={attachment} />
					</Field>
				</FieldGroup>
			</Modal.Content>
			<Modal.Footer>
				<ButtonGroup>
					<Button onClick={handleCopy} disabled={hasCopied}>
						{hasCopied ? t('Copied') : t('Copy_Link')}
					</Button>
					<Button disabled={!rooms.length || sendMessageMutation.isLoading} onClick={() => sendMessageMutation.mutate()} primary>
						{t('Share')}
					</Button>
				</ButtonGroup>
			</Modal.Footer>
		</Modal>
	);
};

export default memo(ShareMessageModal);
