import React from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function SelectMenu({ label, value, onChange, options, id }) {
  return <Select.Root value={value} onValueChange={onChange}>
    <Select.Trigger id={id} className="select-trigger" aria-label={label}>
      <Select.Value /><Select.Icon><ChevronDown size={15} /></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Content className="select-content" position="popper" sideOffset={6} collisionPadding={12}>
      <Select.ScrollUpButton className="select-scroll"><ChevronUp size={14} /></Select.ScrollUpButton>
      <Select.Viewport className="select-viewport">{options.map(([key, text]) => <Select.Item value={key} key={key} className="select-item">
        <Select.ItemText>{text}</Select.ItemText><Select.ItemIndicator><Check size={14} /></Select.ItemIndicator>
      </Select.Item>)}</Select.Viewport>
      <Select.ScrollDownButton className="select-scroll"><ChevronDown size={14} /></Select.ScrollDownButton>
    </Select.Content></Select.Portal>
  </Select.Root>;
}
