import { Meteor } from 'meteor/meteor';
import { TAPi18n } from 'meteor/rocketchat:tap-i18n';
import { api } from '@rocket.chat/core-services';

import { settings } from '../../settings/server';
import { slashCommands } from '../../utils/lib/slashCommand';
import { Users } from '../../models/server';

/*
 * Help is a named function that will replace /help commands
 * @param {Object} message - The message object
 */

interface IHelpCommand {
	key: string;
	command: string;
}

slashCommands.add({
	command: 'help',
	callback: function Help(_command, _params, item): void {
		const userId = Meteor.userId() as string;
		const user = Users.findOneById(userId);

		const keys: IHelpCommand[] = [
			{
				key: 'Open_channel_user_search',
				command: 'Command (or Ctrl) + p OR Command (or Ctrl) + k',
			},
			{
				key: 'Mark_all_as_read',
				command: 'Shift (or Ctrl) + ESC',
			},
			{
				key: 'Edit_previous_message',
				command: 'Up Arrow',
			},
			{
				key: 'Move_beginning_message',
				command: 'Command (or Alt) + Left Arrow',
			},
			{
				key: 'Move_beginning_message',
				command: 'Command (or Alt) + Up Arrow',
			},
			{
				key: 'Move_end_message',
				command: 'Command (or Alt) + Right Arrow',
			},
			{
				key: 'Move_end_message',
				command: 'Command (or Alt) + Down Arrow',
			},
			{
				key: 'New_line_message_compose_input',
				command: 'Shift + Enter',
			},
		];
		keys.forEach((key) => {
			api.broadcast('notify.ephemeralMessage', userId, item.rid, {
				msg: TAPi18n.__(key.key, {
					postProcess: 'sprintf',
					sprintf: [key.command],
					lng: user?.language || settings.get('Language') || 'en',
				}),
			});
		});
	},
	options: {
		description: 'Show_the_keyboard_shortcut_list',
	},
});
