import { supabase } from './supabaseClient';

type UserSettingsRow = {
  id: string;
  user_id: string;
  primary_currency: string;
  created_at: string;
  updated_at: string;
};

export type UserSettings = {
  primaryCurrency: string;
};

/**
 * Load user settings from the database
 */
export const loadUserSettings = async (userId: string): Promise<UserSettings> => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('primary_currency')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no settings found, return default
      if (error.code === 'PGRST116') {
        return { primaryCurrency: 'USD' };
      }
      throw error;
    }

    if (!data) {
      return { primaryCurrency: 'USD' };
    }

    return {
      primaryCurrency: data.primary_currency || 'USD',
    };
  } catch (error) {
    console.error('Error loading user settings:', error);
    // Return default on error
    return { primaryCurrency: 'USD' };
  }
};

/**
 * Save or update user settings in the database
 */
export const saveUserSettings = async (
  userId: string,
  settings: UserSettings
): Promise<UserSettings> => {
  try {
    // Try to update first
    const { data: updateData, error: updateError } = await supabase
      .from('user_settings')
      .update({
        primary_currency: settings.primaryCurrency,
      })
      .eq('user_id', userId)
      .select('primary_currency')
      .single();

    // If update succeeded, return the data
    if (!updateError && updateData) {
      return {
        primaryCurrency: updateData.primary_currency || 'USD',
      };
    }

    // If no row exists (user has no settings yet), insert
    if (updateError && updateError.code === 'PGRST116') {
      const { data: insertData, error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          primary_currency: settings.primaryCurrency,
        })
        .select('primary_currency')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (!insertData) {
        throw new Error('No data returned from insert');
      }

      return {
        primaryCurrency: insertData.primary_currency || 'USD',
      };
    }

    // If update failed for another reason, throw
    throw updateError;
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

