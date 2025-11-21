'use client';

import { Button as HeroButton, ButtonProps as HeroButtonProps } from '@heroui/react';
import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  color,
  children,
  type,
  disabled,
  onClick,
  className = '',
  ...props
}: ButtonProps) {
  const heroColor = color || (variant === 'primary' ? 'primary' : variant === 'danger' ? 'danger' : 'default');
  
  const heroProps: HeroButtonProps = {
    color: heroColor,
    size: size,
    variant: variant === 'ghost' ? 'light' : variant === 'secondary' ? 'bordered' : 'solid',
    type,
    isDisabled: disabled,
    onPress: onClick,
    className,
    ...props,
  };

  return (
    <HeroButton {...heroProps}>
      {children}
    </HeroButton>
  );
}
