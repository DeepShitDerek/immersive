"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LearningSubject } from "@/types";
import { useSaveSubjectMutation } from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { getErrorMessage } from "@/lib/utils";
import {
  learningSubjectSchema,
  type LearningSubjectFormValues,
} from "@/lib/schemas";

interface SubjectFormProps {
  subject: Partial<LearningSubject> | null;
  onSuccess: () => void;
}

export function SubjectForm({ subject, onSuccess }: SubjectFormProps) {
  const [saveSubject, { isLoading }] = useSaveSubjectMutation();
  const form = useForm<LearningSubjectFormValues>({
    resolver: zodResolver(learningSubjectSchema),
    defaultValues: {
      name: subject?.name ?? "",
      description: subject?.description ?? "",
    },
  });

  const handleSubmit = async (values: LearningSubjectFormValues) => {
    try {
      await saveSubject({ ...values, id: subject?.id }).unwrap();
      toast.success(`Subject "${values.name}" saved successfully.`);
      onSuccess();
    } catch (err: unknown) {
      toast.error("Failed to save subject", {
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4 pt-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject Name *</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {subject?.id ? "Save Changes" : "Create Subject"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
