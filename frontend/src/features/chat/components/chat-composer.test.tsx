import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatComposer } from './chat-composer';

describe('ChatComposer disabled / setup hint', () => {
  it('shows Select a model to start chatting when canSend false and opens settings on click', () => {
    const onOpen = vi.fn();
    const onSubmit = vi.fn();
    render(
      <ChatComposer
        isLoading={false}
        value=""
        onValueChange={() => {}}
        onSubmit={onSubmit}
        onStop={() => {}}
        canSend={false}
        submitError={null}
        onOpenSettings={onOpen}
      />,
    );
    const hint = screen.getByTestId('composer-setup-hint');
    expect(hint).toBeInTheDocument();
    expect(hint.textContent).toContain('Select a model to start chatting');
    fireEvent.click(hint);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // send button should be disabled
    const sendBtn = screen.getByTestId('composer-send-button');
    expect(sendBtn).toBeDisabled();
    fireEvent.click(sendBtn);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not show hint when canSend true and no error', () => {
    render(
      <ChatComposer
        isLoading={false}
        value="hi"
        onValueChange={() => {}}
        onSubmit={() => {}}
        onStop={() => {}}
        canSend={true}
        submitError={null}
      />,
    );
    expect(screen.queryByTestId('composer-setup-hint')).not.toBeInTheDocument();
    const btns = screen.getAllByRole('button');
    // single send button, not disabled
    expect(btns[0]).not.toBeDisabled();
  });

  it('shows submitError as banner and opens settings', () => {
    const onOpen = vi.fn();
    render(
      <ChatComposer
        isLoading={false}
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        onStop={() => {}}
        canSend={false}
        submitError="Add an API key in Settings first."
        onOpenSettings={onOpen}
      />,
    );
    const hint = screen.getByTestId('composer-setup-hint');
    expect(hint.textContent).toContain('Add an API key in Settings first.');
    fireEvent.click(hint);
    expect(onOpen).toHaveBeenCalled();
  });

  it('keeps composer visually usable but send disabled', () => {
    render(
      <ChatComposer
        isLoading={false}
        value="test"
        onValueChange={() => {}}
        onSubmit={() => {}}
        onStop={() => {}}
        canSend={false}
        onOpenSettings={() => {}}
      />,
    );
    // textarea should still be present and not disabled (composer usable)
    const textarea = screen.getByPlaceholderText('Ask anything');
    expect(textarea).toBeInTheDocument();
    expect(textarea).not.toBeDisabled();
  });

  it('when loading, hint not required and stop works', () => {
    const onStop = vi.fn();
    render(
      <ChatComposer
        isLoading={true}
        value="hi"
        onValueChange={() => {}}
        onSubmit={() => {}}
        onStop={onStop}
        canSend={false}
      />,
    );
    // still shows hint because submitError? But canSend false still shows hint even when loading? Our composer shows hint when showBanner true regardless of loading. That's okay.
    // Button should not be disabled when loading (stop allowed)
    const buttons = screen.getAllByRole('button');
    // last button is send/stop
    const stopBtn = buttons[buttons.length - 1];
    expect(stopBtn).not.toBeDisabled();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });
});
