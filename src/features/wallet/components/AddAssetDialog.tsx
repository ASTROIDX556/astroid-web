'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/dialog';
import { Input, FormField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addAssetFormSchema, type AddAssetFormValues } from '../schema';

interface AddAssetDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (code: string, issuer: string) => void;
}

export function AddAssetDialog({
  open,
  onClose,
  onAdd,
}: AddAssetDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddAssetFormValues>({
    resolver: zodResolver(addAssetFormSchema),
    mode: 'onBlur',
    defaultValues: { code: '', issuer: '' },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (values: AddAssetFormValues) => {
    onAdd(values.code.trim(), values.issuer.trim());
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add Custom Asset"
      description="Enter the asset code and issuer public key for a Stellar asset."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            Add Asset
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)();
        }}
        className="space-y-5"
        noValidate
      >
        <FormField
          label="Asset Code"
          htmlFor="asset-code"
          hint="1–12 alphanumeric characters (e.g. USDC)"
          error={errors.code?.message}
          required
        >
          <Input
            id="asset-code"
            placeholder="USDC"
            autoComplete="off"
            spellCheck={false}
            {...register('code')}
          />
        </FormField>

        <FormField
          label="Issuer Public Key"
          htmlFor="asset-issuer"
          hint="Stellar public key — starts with 'G', 56 characters"
          error={errors.issuer?.message}
          required
        >
          <Input
            id="asset-issuer"
            placeholder="GA5ZSEJYB37JTH5UA4GHHQTUWQZ3XMY4Y2S3VHLW7A7I73ZMIFR67LMZ"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
            {...register('issuer')}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
