import { Icon, Button } from '@rocket.chat/fuselage';
import type { Keys as IconName } from '@rocket.chat/icons';
import type { TranslationKey } from '@rocket.chat/ui-contexts';
import { useTranslation } from '@rocket.chat/ui-contexts';
import type { ReactElement } from 'react';
import React from 'react';

const resolveLegacyIcon = (legacyIcon: IconName | `icon-${IconName | 'videocam'}`): IconName => {
	if (legacyIcon === 'icon-videocam') {
		return 'video';
	}

	return legacyIcon?.replace(/^icon-/, '') as IconName;
};

type MessageActionProps = {
	icon: IconName;
	i18nLabel?: TranslationKey;
	label?: string;
	methodId: string;
	runAction: (actionId: string) => () => void;
	danger?: boolean;
};

const MessageAction = ({ icon, methodId, i18nLabel, label, runAction, danger }: MessageActionProps): ReactElement => {
	const t = useTranslation();

	const resolvedIcon = resolveLegacyIcon(icon);

	return (
		<Button data-method-id={methodId} onClick={runAction(methodId)} marginInline='x4' small danger={danger}>
			{icon && <Icon name={resolvedIcon} />}
			{i18nLabel ? t(i18nLabel) : label}
		</Button>
	);
};

export default MessageAction;
