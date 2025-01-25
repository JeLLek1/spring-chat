package pl.bronikowski.springchat.backendmain.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = {AllowedMimeTypeValidator.class})
public @interface AllowedMediaType {
    String message() default "Provided media type is not allowed";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    String[] value();
}
