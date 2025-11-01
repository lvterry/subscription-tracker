import { supabase } from './supabaseClient';

export type UserSettings = {
  primaryCurrency: string;
  displayName: string;
};

/**
 * Load user settings from the database
 */
export const loadUserSettings = async (
  userId: string,
  defaultEmail: string
): Promise<UserSettings> => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('primary_currency, display_name')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no settings found, return default
      if (error.code === 'PGRST116') {
        return { primaryCurrency: 'USD', displayName: defaultEmail };
      }
      throw error;
    }

    if (!data) {
      return { primaryCurrency: 'USD', displayName: defaultEmail };
    }

    return {
      primaryCurrency: data.primary_currency || 'USD',
      displayName: data.display_name || defaultEmail,
    };
  } catch (error) {
    console.error('Error loading user settings:', error);
    // Return default on error
    return { primaryCurrency: 'USD', displayName: defaultEmail };
  }
};

/**
 * Save or update user settings in the database
 */
export const saveUserSettings = async (
  userId: string,
  settings: UserSettings,
  defaultEmail: string
): Promise<UserSettings> => {
  try {
    // Try to update first
    const { data: updateData, error: updateError } = await supabase
      .from('user_settings')
      .update({
        primary_currency: settings.primaryCurrency,
        display_name: settings.displayName || defaultEmail,
      })
      .eq('user_id', userId)
      .select('primary_currency, display_name')
      .single();

    // If update succeeded, return the data
    if (!updateError && updateData) {
      return {
        primaryCurrency: updateData.primary_currency || 'USD',
        displayName: updateData.display_name || defaultEmail,
      };
    }

    // If no row exists (user has no settings yet), insert
    if (updateError && updateError.code === 'PGRST116') {
      const { data: insertData, error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          primary_currency: settings.primaryCurrency,
          display_name: settings.displayName || defaultEmail,
        })
        .select('primary_currency, display_name')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (!insertData) {
        throw new Error('No data returned from insert');
      }

      return {
        primaryCurrency: insertData.primary_currency || 'USD',
        displayName: insertData.display_name || defaultEmail,
      };
    }

    // If update failed for another reason, throw
    throw updateError;
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

