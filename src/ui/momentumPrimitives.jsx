import React from 'react';
import PropTypes from 'prop-types';
import { Card, CardSection, Select, SelectOption } from '@momentum-ui/react';

export const MomentumCard = ({ children = null, className = '', dark = false, style = {} }) => (
  <Card className={dark ? 'md-background-color--gray-90 md-color--white-100' : undefined}>
    <CardSection className={className} style={style}>
      {children}
    </CardSection>
  </Card>
);

MomentumCard.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  dark: PropTypes.bool,
  style: PropTypes.object,
};

export const MomentumSelect = ({
  id,
  value = '',
  options = [],
  onChange = () => {},
  disabled = false,
  style = {},
}) => {
  const selectedOption = options.find((option) => option.value === value);
  const defaultValue = selectedOption?.label || options[0]?.label || '';

  return (
    <div style={style}>
      <Select
        key={`${id}-${value}`}
        defaultValue={defaultValue}
        buttonProps={{
          disabled,
          color: 'none',
        }}
        onSelect={(selected) => {
          const picked = Array.isArray(selected) && selected.length > 0 ? selected[0]?.value : null;
          if (picked) {
            onChange(picked);
          }
        }}
      >
        {options.map((option) => (
          <SelectOption
            key={`${id}-${option.value}`}
            value={option.value}
            label={option.label}
          />
        ))}
      </Select>
    </div>
  );
};

MomentumSelect.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string,
    label: PropTypes.string,
  })),
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  style: PropTypes.object,
};

