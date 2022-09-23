import type * as UiKit from '@rocket.chat/ui-kit';
import { useTranslation, useUserAvatarPath } from '@rocket.chat/ui-contexts';
import { Avatar } from '@rocket.chat/fuselage';
import {
  VideoConfMessageSkeleton,
  VideoConfMessage,
  VideoConfMessageRow,
  VideoConfMessageIcon,
  VideoConfMessageText,
  VideoConfMessageFooter,
  VideoConfMessageAction,
  VideoConfMessageUserStack,
  VideoConfMessageFooterText,
} from '@rocket.chat/ui-video-conf';
import type { MouseEventHandler, ReactElement } from 'react';
import React, { useContext, memo } from 'react';

import { useSurfaceType } from '../../contexts/SurfaceContext';
import type { BlockProps } from '../../utils/BlockProps';
import { useVideoConfDataStream } from './hooks/useVideoConfDataStream';
import { kitContext } from '../..';

type VideoConferenceBlockProps = BlockProps<UiKit.VideoConferenceBlock>;

const MAX_USERS = 6;

const VideoConferenceBlock = ({
  block,
}: VideoConferenceBlockProps): ReactElement => {
  const t = useTranslation();
  const { callId, appId = 'videoconf-core' } = block;
  const surfaceType = useSurfaceType();

  const { action, viewId, rid } = useContext(kitContext);

  if (surfaceType !== 'message') {
    return <></>;
  }

  if (!callId || !rid) {
    return <></>;
  }

  const getUserAvatarPath = useUserAvatarPath();
  const result = useVideoConfDataStream({ rid, callId });

  const joinHandler: MouseEventHandler<HTMLButtonElement> = (e): void => {
    action(
      {
        blockId: block.blockId || '',
        appId,
        actionId: 'join',
        value: block.blockId || '',
        viewId,
      },
      e
    );
  };

  const callAgainHandler: MouseEventHandler<HTMLButtonElement> = (e): void => {
    action(
      {
        blockId: rid || '',
        appId,
        actionId: 'callBack',
        value: rid || '',
        viewId,
      },
      e
    );
  };

  if (result.isSuccess) {
    const { data } = result;

    if ('endedAt' in data) {
      return (
        <VideoConfMessage>
          <VideoConfMessageRow>
            <VideoConfMessageIcon />
            <VideoConfMessageText>{t('Call_ended')}</VideoConfMessageText>
          </VideoConfMessageRow>
          <VideoConfMessageFooter>
            {data.type === 'direct' && (
              <>
                <VideoConfMessageAction onClick={callAgainHandler}>
                  {t('Call_back')}
                </VideoConfMessageAction>
                <VideoConfMessageFooterText>
                  {t('Call_was_not_answered')}
                </VideoConfMessageFooterText>
              </>
            )}
            {data.type !== 'direct' &&
              (data.users.length ? (
                <>
                  <VideoConfMessageUserStack>
                    {data.users.map(({ username }, index) =>
                      data.users.length <= MAX_USERS ? (
                        <Avatar
                          size='x28'
                          key={index}
                          data-tooltip={username}
                          url={getUserAvatarPath(username as string)}
                        />
                      ) : (
                        <></>
                      )
                    )}
                  </VideoConfMessageUserStack>
                  <VideoConfMessageFooterText>
                    {data.users.length > 6
                      ? `+ ${MAX_USERS - data.users.length} ${t('Joined')}`
                      : t('Joined')}
                  </VideoConfMessageFooterText>
                </>
              ) : (
                <VideoConfMessageFooterText>
                  {t('Call_was_not_answered')}
                </VideoConfMessageFooterText>
              ))}
          </VideoConfMessageFooter>
        </VideoConfMessage>
      );
    }

    if (data.type === 'direct' && data.status === 0) {
      return (
        <VideoConfMessage>
          <VideoConfMessageRow>
            <VideoConfMessageIcon variant='incoming' />
            <VideoConfMessageText>{t('Calling')}</VideoConfMessageText>
          </VideoConfMessageRow>
          <VideoConfMessageFooter>
            <VideoConfMessageAction primary onClick={joinHandler}>
              {t('Join')}
            </VideoConfMessageAction>
            <VideoConfMessageFooterText>
              {t('Waiting_for_answer')}
            </VideoConfMessageFooterText>
          </VideoConfMessageFooter>
        </VideoConfMessage>
      );
    }

    return (
      <VideoConfMessage>
        <VideoConfMessageRow>
          <VideoConfMessageIcon variant='outgoing' />
          <VideoConfMessageText>{t('Call_ongoing')}</VideoConfMessageText>
        </VideoConfMessageRow>
        <VideoConfMessageFooter>
          <VideoConfMessageAction primary onClick={joinHandler}>
            {t('Join')}
          </VideoConfMessageAction>
          <VideoConfMessageUserStack>
            {data.users.map(({ username }, index) =>
              data.users.length <= MAX_USERS ? (
                <Avatar
                  size='x28'
                  key={index}
                  data-tooltip={username}
                  url={getUserAvatarPath(username as string)}
                />
              ) : (
                <></>
              )
            )}
          </VideoConfMessageUserStack>
          <VideoConfMessageFooterText>
            {data.users.length > 6
              ? `+ ${MAX_USERS - data.users.length} ${t('Joined')}`
              : t('Joined')}
          </VideoConfMessageFooterText>
        </VideoConfMessageFooter>
      </VideoConfMessage>
    );
  }

  return <VideoConfMessageSkeleton />;
};

export default memo(VideoConferenceBlock);
